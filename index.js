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
const joi = require("joi");


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

app.use(express.static("/public" + __dirname));
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
    select*, DATE_FORMAT(sent_datetime, '%Y-%m-%d %H:%i:%s') AS formatted_sent_datetime, rx.user_id as rx_user
    from message as m
    left join room_user as ru USING(room_user_id)
    left join user as u USing(user_id)
    left join room as r using(room_id)
    left join reaction as rx using(message_id)
    left join emoji as e USING(emoji_id)
    where r.name = ?
    order by m.sent_datetime;
    `
    const [messages] = await connection.query(query2, [groupName])

    for (const message of messages) {
        if (!message.emoji_id) {
            message.emoji_id = 0
        }
    }

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
    SET last_read_message_id = ?
    WHERE room_user_id = ?;
    `;
    await connection.query(query, [last_message, room_user_id]);


}

async function getUnreadMessages(user_id) {
    const connection = await createConnection()
    const query = `
    with last as (
	select ru.room_id, ru.user_id, count(*) as unreadCount
    from room_user as ru
	left join room as r using (room_id)
	left join user as u using (user_id)
	left join message as m using(room_user_id)
    where m.message_id > ru.last_read_message_id and ru.user_id = ?
    group by ru.room_id, ru.user_id

    )
    select *
    from last
    join room as r using(room_id);
    
    `
    const unreadMessages = await connection.query(query, [user_id]) 
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

    try {
        // Step 1: Check if the user is already in the room
        const checkQuery = `
            SELECT * FROM room_user 
            WHERE user_id = ? AND room_id = ?;
        `;
        const [rows] = await connection.execute(checkQuery, [user_id, new_room_id]);

        // If user already exists in the room, don't add them again
        if (rows.length > 0) {
            console.log(`User ID ${user_id} is already in room ID ${new_room_id}`);
            return;
        }

        // Step 2: If user is not in the room, insert them
        const insertQuery = `
            INSERT INTO room_user (user_id, room_id)
            VALUES (?, ?);
        `;
        await connection.execute(insertQuery, [user_id, new_room_id]);

        console.log(`User ID ${user_id} added to room ID ${new_room_id}`);
    } catch (error) {
        console.error("Error adding user to room:", error.message);
    } finally {
        // Ensure the connection is closed after operation
        connection.end();
    }
}



async function getUserInGroup(room_id) {
    const connection = await createConnection();

    console.log(room_id)

    // Step 1: Check if the user is already in the room
    const checkQuery = `
        SELECT * 
        FROM room_user as ru
        join user as u using(user_id)
        WHERE ru.room_id = ?;
    `;
    const [rows] = await connection.query(checkQuery, [room_id]);

    // If user already exists in the room, don't add them again
    return rows





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

async function getUsers() {

    const connection = await createConnection()
    const query = `
    Select username
    from user;;
   `
    let [userList] = await connection.query(query)

    console.log(userList)
    return userList
}

async function checkUserInRoom(user_id, room_id) {

    const connection = await createConnection()
    const query = `
    select * from room_user
    where user_id = ? and room_id = ?; 
   `
    const [row] = await connection.query(query, [user_id, room_id]);

    // If user already exists in the room, don't add them again
    if (row.length > 0) {
        console.log(`User ID ${user_id} is already in room ID ${room_id}`);
        return true;
    }
    return false
}








app.get('/Main/*', IsAuthenticated, async (req, res) => {
    console.log(req.url)
    const [rooms] = await getRooms(req.session.username)
    for (const room of rooms) {
        room.unreadCount = 0
    }

    console.log("groups: ", rooms)
    const groupName = req.params[0]
    let [messages] = await getMessages(groupName) || []

    let usernames_in_room = []
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

        console.log("message", messages)

        const room_id = await getRoomId(groupName)
        console.log("room ID =", room_id)
        updatelastreadmessage(last_message_id, room_user_id)

        var users_in_room = await getUserInGroup(room_id.room_id);

        // Use map to create an array of usernames
        usernames_in_room = users_in_room.map(user => user.username);

        console.log('usernames:', usernames_in_room);


    }

    user_id = req.session.user_id
    console.log("user_id =", user_id)
    let [unreadMessages] = await getUnreadMessages(user_id)
    console.log("unread mes = ", unreadMessages)

    
    for (const unread of unreadMessages) {
        if (unreadMessages.length == 0) {
            break
        }
        rooms.forEach(room => {
            if (unread.name == room.name) {
                room.unreadCount = unread.unreadCount
                console.log("unread  = ", unread.unreadCount)
            }
        })

    }
    console.log(rooms)
    const users = await getUsers();
    // console.log(users)

    res.render('main.ejs', {
        rooms, groupName, messages,
        users: users,
        usernames_in_room: usernames_in_room || []
        // Ensure it's never null
    })

})


app.post('/Main/createNewChat', async (req, res) => {
    try {
        console.log('Full request body:', req.body);

        const { newChatName } = req.body;
        console.log('Extracted new chat name:', newChatName);

        if (!newChatName) {
            console.error('No chat room name provided');
            return res.status(400).json({ message: 'Chat room name is required' });
        }

        const room_id_new = await createNewChat(newChatName)
        let user_id = req.session.user_id
        console.log(user_id)
        console.log("new room id =", room_id_new.room_id)

        await addUserToRoom(user_id, room_id_new.room_id)


        console.log('Chat room created:', newChatName);
        return res.status(200).json({ message: 'Chat room created successfully' });

    } catch (error) {
        console.error('Error creating chat room:', error.message);
        return
    }

});

app.post("/Main/updateMember", async (req, res) => {
    try {
        console.log("Full request body:", req.body);

        const { groupName, users } = req.body;

        if (!groupName || !users || users.length === 0) {
            console.error("Invalid data provided");
            return res.status(400).json({ message: "Group name and users are required." });
        }

        console.log("Group Name:", groupName);
        console.log("Users:", users);

        const room_id = await getRoomId(groupName);
        if (!room_id) {
            console.error("Group not found:", groupName);
            return
        }

        console.log("Room ID:", room_id);

        const addedUsers = [];
        const skippedUsers = [];

        await Promise.all(users.map(async (user) => {
            const [user_id] = await getUserId(user);
            console.log("User ID:", user_id);
            if (await checkUserInRoom(user_id.user_id, room_id.room_id)) {
                console.log("User already in room:", user);
                skippedUsers.push(user);
            } else {
                console.log("Adding user to room:", user);
                await addUserToRoom(user_id.user_id, room_id.room_id);
                addedUsers.push(user);
            }
        }));

        console.log("New members added:", addedUsers);
        return res.status(200).json({
            message: "New members added successfully",
            added: addedUsers,
            skipped: skippedUsers,
        });

    } catch (error) {
        console.error("Error adding members:", error.message);
        return
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


app.post('/updateEmoji', async (req, res) => {
    const { emoji_id, message_id, groupName } = req.body;
    console.log("emoji_id:", emoji_id)
    console.log("message_id:", message_id)
    console.log("groupName:", groupName)

    user_id = req.session.user_id

    try {
        const connection = await createConnection()
        const query = `
        Select * 
        from reaction
        where message_id = ? and user_id = ?; 
        `
        const [result] = await connection.query(query, [message_id, user_id]) || []
        console.log("result emoji", result.length)

        if (result.length > 0) {
            const query2 = `
            UPDATE reaction
            SET emoji_id = ?
            WHERE message_id = ?;
            `
            await connection.query(query2, [emoji_id, message_id])
            
        } else {
            const query3 = `
            insert into reaction(message_id, emoji_id, user_id)
            values(?,? ,? );
            `
            await
                connection.query(query3, [message_id, emoji_id, user_id])
        }
    }
    catch (error) {
        console.log(error)
    }

    res.status(200).json({ message: "Emoji updated successfully" })
    
})



app.get('/SignUp', (req, res) => {
    res.render('signup.ejs', {
        message: "Please sign up"
    }
    )
})

app.post('/SignUp', async (req, res) => {

    const { username, password } = req.body;

    const schema = joi.object({
        username: joi.string().alphanum().min(3).max(30).required(),
        password:
            joi.string()
                .min(10)  // minimum length of 10 characters
                .pattern(/[A-Z]/, 'uppercase')  // at least one uppercase letter
                .pattern(/[a-z]/, 'lowercase')  // at least one lowercase letter
                .pattern(/\d/, 'digit')  // at least one digit
                .pattern(/[\W_]/, 'special character')  // at least one special character
                .required()  // password is requiredjoi.string().alphanum().min(10).max(30).required()
    })

    const validation = schema.validate(req.body)

    if (validation.error) {
        console.log(validation.error + ' error')
        res.render('signup.ejs', {
            message: validation.error
        })
        return
    }



    try {
        const connection = await createConnection();
        const query = `SELECT * FROM user WHERE username = ?`;
        const [result] = await connection.query(query, [username])
        connection.end()
        if (result.length > 0) {
            console.log("username already exists");
            return res.render('signup.ejs', {
                message: "This username already exists try another one"
            });
        }
    } catch (error) {
        console.log(error);
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds)
    const query = `INSERT INTO user (username, password_hash) VALUES (?, ?)`
    const connection = await createConnection();
    await connection.query(query, [username.trim(), hashedPassword]);
    res.redirect('/Login');

})

app.get('/Login', (req, res) => {
    res.render('login.ejs',
        {
            message: "Please log in"
        }
    )
})



app.post('/Login', async (req, res) => {
    const { username, password } = req.body


    const schema = joi.object({
        username: joi.string().alphanum().min(3).max(30).required(),
        password: joi.string()
            .min(10)  // minimum length of 10 characters
            .pattern(/[A-Z]/, 'uppercase')  // at least one uppercase letter
            .pattern(/[a-z]/, 'lowercase')  // at least one lowercase letter
            .pattern(/\d/, 'digit')  // at least one digit
            .pattern(/[\W_]/, 'special character')  // at least one special character
            .required()  // password is required
    })

    const validation = schema.validate(req.body)
    if (validation.error) {
        console.log(validation.error + ' error')
        res.redirect('/Login')
        return
    }



    const connection = await createConnection()
    const query = `SELECT * FROM user WHERE username = ?`
    const [result] = await connection.query(query, [username.trim()]);
    connection.end()
    if (result.length === 0) {
        console.log("This User Does Not Exist")
        return res.render('login.ejs', {
            message: "This User Does Not Exist"
        });
    }

    const user = result[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash)
    console.log("passwordMatch:", passwordMatch)
    if (passwordMatch) {
        req.session.authenticated = true
        req.session.username = user.username
        req.session.user_id = user.user_id
        res.redirect('/Main/');
    } else {
        return res.render('login.ejs', {
            message: "Invalid username or password"
        });

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


