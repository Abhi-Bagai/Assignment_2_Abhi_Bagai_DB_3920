const express = require('express') // import express
const app = express() // create express app
require('dotenv').config() // load .env file
const port = process.env.PORT || 3000 // default port to listen
var session = require('express-session') // import express-session
const { MongoClient, ObjectId } = require('mongodb')
const MongoStore = require('connect-mongo') // import connect-mongo
const bcrypt = require('bcrypt') // import bcrypt

const ejs = require('ejs')
app.set('view engine', 'ejs')
const url = require('url')


// environment variables

const mongodb_user = process.env.MONGODB_USER
const mongodb_password = process.env.MONGODB_PASSWORD
const mongodb_session_secret = process.env.MONGODB_SESSION_SECRET
const mongodb_host = process.env.MONGODB_HOST
const node_session_secret = process.env.NODE_SESSION_SECRET


const database = process.env.DATABASE
const dbuser = process.env.DATABASE_USER
const dbpassword = process.env.DATABASE_PASSWORD
const dbhost = process.env.DATABASE_HOST
const dbport = process.env.DATABASE_PORT

const saltRounds = 12;
const expirytime = 60 * 60 * 1000// (milliseconds * sec * min) 1 hour

// DB connection

const mysql = require("mysql2/promise")
// const { trace } = require('console')
async function createConnection() {
    return await mysql.createConnection({
        host: dbhost,
        user: dbuser,
        password: dbpassword,
        database: database,
        port: dbport,
        connectTimeout: 100000, // 100 seconds
        multipleStatements: false
    });
}

// session middleware
var mongoStore = MongoStore.create({
    mongoUrl: `mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/sessions`,
    crypto: {
        secret: mongodb_session_secret
    }
})


// session middleware
app.use(session({
    secret: node_session_secret,
    saveUninitialized: false,
    resave: true,
    store: mongoStore,
    cookie: {
        maxAge: expirytime
    }
}))


app.use(express.urlencoded({ extended: false }))


let navLinks = [
    { link: '/Home', text: 'Home' },
    { link: '/SignUp', text: 'Sign Up' },
    { link: '/Login', text: 'Login' },
    { link: '/Main', text: 'Main' },
    { link: '/Logout', text: 'Logout' }

];

app.use('/', (req, res, next) => {
    app.locals.auth = req.session.authenticated
    app.locals.navLinks = navLinks;
    app.locals.currentURL = req.url
    app.locals.username = req.session.username;
    next();

})


//authentication middleware
// regular users
function IsAuthenticated(req, res, next) {
    if (req.session.authenticated) {
        console.log(req.session.authenticated)
        return next()
    }
    else {
        res.render('login.ejs', {
            message: "You must be logged in to view this page"
        })
        return


    }
}

app.use(express.static(__dirname + "/public"));



// routes

app.get('/', (req, res, next) => {
    res.redirect('/Home')
    next();
})




app.get('/Home', (req, res) => {
    console.log(req.url)
    res.render('home.ejs')
})


app.get('/Main', IsAuthenticated, async (req, res) => {
    console.log(req.url)
    const connection = await createConnection()
    const query = `select r.name
        from user as u
        join room_user as ru using(user_id)
        join room as r using(room_id)
        where username = ?; `
    
    const [groups] = await connection.query(query, req.session.username)

    console.log(groups)

    res.render('main.ejs',
        {
            username: req.session.username, groups   
        })
})

// app.get('/SignUp', (req, res) => {
//     res.render('signup.ejs', {
//         message: "Please sign up"
//     }
//     )
// })

// app.post('/SignUp', async (req, res) => {

//     const { username, password } = req.body;
//     const checkLetter = /[a-zA-Z]+$/;
//     if (!username.match(checkLetter)) {
//         console.log("username must contain only letters")
//         return res.render('signup.ejs', {
//             message: "username must contain only letters no special characters or numbers"
//         });
//     }
//     if (password.length < 8) {
//         console.log("password must be at least 8 characters long")
//         return res.render('signup.ejs', {
//             message: "password must be at least 8 characters long"
//         });
//     }

//     try {
//         const connection = await createConnection();
//         const query = `SELECT * FROM user WHERE username = ?`;
//         const [result] = await connection.query(query, [username])
//         connection.end()
//         if (result.length > 0) {
//             console.log("username already exists");
//             return res.render('signup.ejs', {
//                 message: "This username already exists try another one"
//             });
//         }
//     } catch (error) {
//         console.log(error);
//     }

//     const hashedPassword = await bcrypt.hash(password, saltRounds)
//     const query = `INSERT INTO user (username, password) VALUES (?, ?)`
//     const connection = await createConnection();
//     const [result] = await connection.query(query, [username, hashedPassword]);
//     res.redirect('/Login');
//     console.log(result);
// })

app.get('/Login', (req, res) => {
    res.render('login.ejs',
        {
            message: "Please log in"
        }
    )
})



async function createTable() {
    const connection = await createConnection()
    const query = `
    CREATE TABLE ${database}.\`user\` (
        \`user_id\` INT NOT NULL AUTO_INCREMENT,
        \`username\` VARCHAR(45) NOT NULL,
        \`password\` VARCHAR(100) NOT NULL,
        PRIMARY KEY (\`user_id\`),
        UNIQUE INDEX \`username_UNIQUE\` (\`username\` ASC) VISIBLE
    )`;
    try {
        const [result] = await connection.query(query)
        console.log("Table created successfully:", result)
    } catch (err) {
        console.error('Error creating table:', err)
    } finally {
        await connection.end()
    }
}

async function showTable() {
    const connection = await createConnection();
    const query = `select * from user`;
    try {
        const [result] = await connection.query(query);
        console.log("Table User:", result)
    } catch (err) {
        console.error('Error creating table:', err)
    } finally {
        await connection.end()
    }
}

// createTable()
// showTable()


app.post('/Login', async (req, res) => {
    const { username, password } = req.body
    // const checkLetter = /[a-zA-Z]+$/
    // if (!username.match(checkLetter)) {
    //     console.log("username must contain only letters")
    //     return res.render('login.ejs', {
    //         message: "username must contain only letters"
    //     });
    // }
    try {
        const connection = await createConnection()
        const query = `SELECT * FROM user WHERE username = ?`
        const [result] = await connection.query(query, [username]);
        connection.end()
        if (result.length === 0) {
            console.log("This User Does Not Exist")
            return res.render('login.ejs', {
                message: "This User Does Not Exist"
            });
        }

        const user = result[0];
        // const passwordMatch = await bcrypt.compare(password, user.password)

        const passwordMatch = (user.password_hash === password)

        if (!passwordMatch) {
            return res.render('login.ejs', {
                message: "Invalid username or password"
            });
        } else {
            req.session.authenticated = true
            req.session.username = username
            res.redirect('/Main');
        }
    } catch (err) {
        console.log('Error executing query:', err)
        res.status(500).send('Internal Server Error')
    }

})


app.get('/Logout', (req, res) => {
    req.session.destroy()
    res.redirect('/Home')
})


app.get('*', (req, res) => {
    res.status(404)
    res.render('404.ejs')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})