const express = require('express') // import express
const app = express() // create express app
require('dotenv').config() // load .env file
const port = process.env.PORT || 3000 // default port to listen
var session = require('express-session') // import express-session
const { MongoClient, ObjectId, MaxKey } = require('mongodb')
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
const { group } = require('console')
const { rootCertificates } = require('tls')
const { promise } = require('bcrypt/promises')
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
    { link: '/Main/', text: 'Main' },
    { link: '/Logout', text: 'Logout' }

];

app.use('/', (req, res, next) => {
    app.locals.auth = req.session.authenticated
    app.locals.navLinks = navLinks;
    app.locals.currentURL = req.url
    app.locals.username = req.session.username;
    app.locals.user_id = req.session.user_id;


    next();

})


//authentication middleware
// regular users
function IsAuthenticated(req, res, next) {
    if (req.session.authenticated) {
        // console.log(req.session.authenticated)
        return next()
    }
    else {
        res.render('login.ejs', {
            message: "You must be logged in to view this page"
        })
        return


    }
}

app.use(express.static("/public" + __dirname ));
app.use(express.static('public'));
app.use(express.json());


// routes

app.get('/', (req, res, next) => {
    res.redirect('/Home')
    next();
})




app.get('/Home', (req, res) => {
    console.log(req.url)
    res.render('home.ejs')
})

// helper functions


async function getRooms(username) {
    // console.log(username)
    const connection = await createConnection()
    const query = `
    select r.name
    from user as u
    join room_user as ru using(user_id)
    join room as r using(room_id)
    where username = ? ; `
    const [rooms] = await connection.query(query, [username])
    return [rooms]
}

async function getMessages(groupName) {
    const connection = await createConnection()
    const query2 = `
    select*, DATE_FORMAT(sent_datetime, '%Y-%m-%d %H:%i:%s') AS formatted_sent_datetime
    from message as m
    join room_user as ru USING(room_user_id)
    join user as u USing(user_id)
    join room as r using(room_id)
    where r.name = ?
    order by m.sent_datetime;`
    const [messages] = await connection.query(query2, [groupName])
    return [messages]
}

async function getRoomUserId(username, groupName) {
    const connection = await createConnection()
    const query = `
    select ru.room_user_id
    from room_user as ru
    join room as r using(room_id)
    join user as u using(user_id)
    where u.username = ? and r.name = ?; `
    const [roomuseridlist] = await connection.query(query, [username, groupName])
    console.log("ruID:", roomuseridlist)
    let roomuserid = roomuseridlist[0].room_user_id
    return roomuserid

}

// console.log(getRoomUserId("nothingspecial", "School Notes"))

async function newMessage(room_user_id, sendmessage) {
    const connection = await createConnection()
    const query2 =
        `INSERT into message(room_user_id, text)
    values( ? , ?);`
    await connection.query(query2, [room_user_id, sendmessage])
}


async function updatelastreadmessage(last_message, room_user_id) {
    const connection = await createConnection()
    const query = `
    UPDATE room_user 
    SET last_read_message_id = ${last_message}
    WHERE room_user_id = ${room_user_id};`
    await connection.query(query)

}

async function getUnreadMessages(user_id) {
    const connection = await createConnection()
    const query = `
    CALL get_unread_messages(?);`
    let [unreadMessages] = await connection.query(query, [user_id])
    return unreadMessages
}


async function getRoomId(groupName) {
    const connection = await createConnection()
    const query = `
    select room_id
    from room
    where name = ?;`
    let [room_id] = await connection.query(query, [groupName])

    return room_id.length ? room_id[0] : null;

}



async function getLastReadMessageId(room_user_id) {
    const connection = await createConnection()
    const query = `
    Select last_read_message_id
    From room_user
    WHERE room_user_id = ?;
   `
    let [last_message_id] = await connection.query(query, [room_user_id])
    return last_message_id

}

async function createNewChat(new_room_name) {
    const connection = await createConnection();

    // Step 1: Insert the new chat room into the room table
    const query = `
        INSERT INTO room (name)
        VALUES (?);
    `;
    await connection.query(query, [new_room_name]);
    console.log("Chat room created");
    const new_room_id = await getRoomId(new_room_name)
    return new_room_id
}



async function addUserToRoom(user_id, new_room_id) {
    const connection = await createConnection();
    
    if (!new_room_id) {
        console.error('Failed to get room ID')
        return;
    }
    const query2 = `
        INSERT INTO room_user (user_id, room_id)
        VALUES (?, ?);
    `;
    await connection.query(query2, [user_id, new_room_id])

    console.log("Chat room created and user added to the room")
}

async function getUserId(username) {
    const connection = await createConnection()
    const query = `

    SELECT user_id
    FROM user
    Where username = ?;
   `
    let [new_member_id] = await connection.query(query, [username])
    return new_member_id

    
}





app.get('/Main/*', IsAuthenticated, async (req, res) => {
    console.log(req.url)
    const [rooms] = await getRooms(req.session.username)
    for (const room of rooms) {
        room.unreadCount = 0
    }

    console.log("groups: ", rooms)
    const groupName = req.params[0]
    let [messages] = await getMessages(groupName)
    if (groupName != false) {

        console.log("groupName =", groupName)

        let room_user_id = await getRoomUserId(req.session.username, groupName)
        let [last_message_id] = await getLastReadMessageId(room_user_id)
        console.log("last mes ID =", last_message_id)
        last_message_id = last_message_id.last_read_message_id
        messages.forEach(message => {
            // console.log(message.message_id)
            if (message.message_id <= last_message_id) {
                message.isUnread = false
            } else {
                message.isUnread = true
            }
        })
        messages.forEach(message => {
            if (message.message_id >= last_message_id) {
                last_message_id = message.message_id;
            }

        })

        const room_id = await getRoomId(groupName)
        console.log("room ID =", room_id)
        updatelastreadmessage(last_message_id, room_user_id)

    }

    let [unreadMessages] = await getUnreadMessages(req.session.user_id)
    console.log("unread mes = ", unreadMessages)

    for (unread of unreadMessages) {
        for (const room of rooms) {
            if (unread.name == room.name) {
                room.unreadCount = unread.unread_message_count
            }
        }
    }
    console.log(rooms)




    res.render('main.ejs', { rooms, groupName, messages })

})


app.post('/Main/createNewChat', async (req, res) => {
    try {
        // console.log('Full request body:', req.body);

        const { newChatName } = req.body;
        console.log('Extracted new chat name:', newChatName);

        if (!newChatName) {
            console.error('No chat room name provided');
            return res.status(400).json({ message: 'Chat room name is required' });
        }

        const room_id_new = await createNewChat(newChatName) 
        let user_id = req.session.user_id
        console.log(user_id)
        console.log("new room id =",room_id_new.room_id)

        setTimeout(() => addUserToRoom(user_id, room_id_new.room_id), 1000);


        console.log('Chat room created:', newChatName);
        return res.status(200).json({ message: 'Chat room created successfully' });

    } catch (error) {
        console.error('Error creating chat room:', error.message);
        return res.status(500).json({ message: 'Internal Server Error' });
    }

});

app.post('/Main/addNewMember', async (req, res) => {
    try {
        console.log('Full request body:', req.body);

        const { newMemberName, groupName } = req.body;
        console.log('Extracted new member name:', newMemberName);
        console.log('Extracted group name:', groupName);

        if (!newMemberName) {
            console.error('No newMemberName provided');
            return res.status(400).json({ message: 'newMemberName is required' });
        }

        const [member_id] = await getUserId(newMemberName)
        // nothingspecial

        const room_id = await getRoomId(groupName)
        console.log("memID", member_id)
        console.log("roomID",room_id)

        if (!member_id || !room_id) {
            return res.status(404).json({ message: 'Member or room not found' });
        }

        // console.log("new room id =", room_id_new.room_id)

        setTimeout(() => addUserToRoom(member_id.user_id, room_id.room_id), 1000);


        console.log('newMember added:', newMemberName);
        return res.status(200).json({ message: 'newMember added successfully' });

    } catch (error) {
        console.error('Error adding member:', error.message);
        return res.status(500).json({ message: 'Internal Server Error' });
    }

});






// Route for sending messages
app.post('/Main/:groupName', async (req, res) => {
    const sendmessage = req.body.message;
    const groupName = req.params.groupName;
    const username = req.session.username;

    if (sendmessage) {
        try {
            const room_user_id = await getRoomUserId(username, groupName);
            console.log('Room user ID:', room_user_id);
            await newMessage(room_user_id, sendmessage);
            return res.redirect('/Main/' + groupName);
        } catch (error) {
            console.error('Error sending message:', error);
            return res.status(500).json({ message: 'Failed to send message' });
        }
    }

    return res.status(400).json({ message: 'Invalid message data' });
});










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



// async function createTable() {
//     const connection = await createConnection()
//     const query = `
//     CREATE TABLE ${database}.\`user\` (
//         \`user_id\` INT NOT NULL AUTO_INCREMENT,
//         \`username\` VARCHAR(45) NOT NULL,
//         \`password\` VARCHAR(100) NOT NULL,
//         PRIMARY KEY (\`user_id\`),
//         UNIQUE INDEX \`username_UNIQUE\` (\`username\` ASC) VISIBLE
//     )`;
//     try {
//         const [result] = await connection.query(query)
//         console.log("Table created successfully:", result)
//     } catch (err) {
//         console.error('Error creating table:', err)
//     } finally {
//         await connection.end()
//     }
// }

// async function showTable() {
//     const connection = await createConnection();
//     const query = `select * from user`;
//     try {
//         const [result] = await connection.query(query);
//         console.log("Table User:", result)
//     } catch (err) {
//         console.error('Error creating table:', err)
//     } finally {
//         await connection.end()
//     }
// }

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
            req.session.username = user.username
            req.session.user_id = user.user_id
            res.redirect('/Main/');
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