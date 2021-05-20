const express = require("express");
const routes = express.Router();
const pgp = require('pg-promise')();

routes.use(express.json());

const db = pgp({
    database: 'weather',
    user: 'postgres',
});

// db.many('SELECT * from states').then(() => console.log('works!'));


routes.get('/states', async (req, res) => {
    res.json(await db.many("SELECT * from states"));
});

routes.get('/city', async (req, res) => {
    res.json(await db.many(`
        SELECT c.id, s.name as state, c.name as city
        from cities c
        INNER JOIN states s ON s.abbrev = c.state_abbrev
        `));
});

routes.get('/states/:abbrev', async (req, res) => {

    const state = await db.oneOrNone("SELECT * from states WHERE abbrev = $(abbrev)", {
        abbrev: req.params.abbrev

    });

    if (!state) {
        return res.status(404).send('The state could not be found.');
    }

    res.json(state);
});


routes.post('/states', async (req, res) => {



    // const existing = await db.one('SELECT abbrev, name FROM states WHERE abbrev = $(abbrev)',
    // { abbrev: req.body.abbrev });

    // if (existing) {
    //     return res.status(400).send("The state already exists.");
    // }
    try {

        await db.none(`
        INSERT INTO states (abbrev, name) VALUES ($(abbrev), $(name))
    `, {
            abbrev: req.body.abbrev,
            name: req.body.name
        });

        const state = await db.one("SELECT abbrev, name FROM states WHERE abbrev = $(abbrev)", { abbrev: req.body.abbrev });

        res.status(201).json(state);

    } catch (error) {
        if (error.constraint === 'states_pkey') {
            return res.status(400).send("The state already exists.");
        }
    }

});

routes.post('/city', async (req, res) => {

    try {
        const result = await db.oneOrNone(`INSERT INTO cities (state_abbrev, name, climate) VALUES ($(state_abbrev), $(name), $(climate)) RETURNING id`,
            {
                state_abbrev: req.body.state_abbrev,
                name: req.body.name,
                climate: req.body.climate
            });

        const city = await db.one("SELECT id, state_abbrev, name, climate FROM cities WHERE id = $(id)", { id: result.id });

        return res.status(201).json(city);

    } catch (error) {
        if (error.constraint === 'cities_name') {
            return res.status(400).send("The city already exists.");
        }
    };

});

routes.post('/temp', async (req, res) => {

    try {

        const result = await db.oneOrNone(`INSERT INTO temperatures (city_id, temperature, date) VALUES ($(city_id), $(temperature), $(date)) RETURNING id`,
            {
                city_id: req.body.city_id,
                temperature: req.body.temperature,
                date: req.body.date
            });

        const temp = await db.one("SELECT city_id, temperature, date FROM temperatures WHERE id = $(id)", { id: result.id });

        return res.status(201).json(temp);

    } catch (error) {
        if (error.constraint === 'temp_date') {
            return res.status(400).send("The temp already exists for this date.");
        }
    };

});

routes.get('/city/:id', async (req, res) => {

    res.json(await db.oneOrNone(`
        SELECT c.name, avg(temperature)
        from temperatures t
        INNER JOIN cities c ON c.id = t.city_id
        WHERE c.id = $(city_id)
        group by c.id, c.name
        `, {
        city_id: +req.params.id
    }));
});


routes.get('/temperature/:climate', async (req, res) => {

    res.json(await db.oneOrNone(`
        SELECT climate, c.name, avg(temperature)
        from temperatures t
        INNER JOIN cities c ON c.id = t.city_id
        WHERE c.climate = $(climate)
        group by climate, c.name
        `, {
        climate: req.params.climate
    }));
});

routes.delete('/city/:id', async (req, res) => {
    await db.none(`DELETE from cities WHERE id = $(id)`,
        {
            id: +req.params.id
        });

    res.status(204).send();
});

routes.delete('/states/:abbrev', async (req, res) => {
    await db.none(`DELETE from states WHERE abbrev = $(abbrev)`,
        {
            abbrev: req.params.abbrev
        });

    res.status(204).send();
});

routes.delete('/temperature/:id', async (req, res) => {
    await db.none(`DELETE from temperatures WHERE id = $(id)`,
        {
            id: +req.params.id
        });

    res.status(204).send();
});

routes.put('/city/:id', async (req, res) => {

    const result = await db.oneOrNone(`UPDATE cities SET state_abbrev = $(state_abbrev), name = $(name), climate = $(climate) WHERE id = $(id) RETURNING id`,
        {
            id: +req.params.id,
            state_abbrev: req.body.state_abbrev,
            name: req.body.name,
            climate: req.body.climate
        });

    if (!result) {
        return res.status(404).send("That city is not found.")
    };

    const updatedCity = await db.one(`SELECT * from cities WHERE id = $(id)`, { id: +req.params.id })

    res.status(201).json(updatedCity);


});

routes.put('/states/:abbrev', async (req, res) => {


    const result = await db.oneOrNone(`UPDATE states SET abbrev = $(abbrev), name = $(name) WHERE abbrev = $(abbrev) RETURNING abbrev`,
        {
            abbrev: req.params.abbrev,
            name: req.body.name,
        });

    if (!result) {
        return res.status(404).send("That state is not found.")
    };

    const updatedState = await db.one(`SELECT * from states WHERE abbrev = $(abbrev)`, { abbrev: req.params.abbrev })

    res.status(201).json(updatedState);


});

routes.put('/temperature/:id', async (req, res) => {

    const result = await db.oneOrNone(`UPDATE temperatures SET city_id = $(city_id), temperature = $(temperature), date = $(date) WHERE id = $(id) RETURNING id`,
        {
            id: +req.params.id,
            city_id: +req.body.city_id,
            temperature: req.body.temperature,
            date: req.body.date,
        });

    if (!result) {
        return res.status(404).send("That temperature record is not found.")
    };

    const updatedTemp = await db.one(`SELECT * from temperatures WHERE id = $(id)`, { id: +req.params.id })

    res.status(201).json(updatedTemp);


});


module.exports = routes;
