const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const cors = require("cors");
const socketIO = require('socket.io');
const User = require('./models/User');
const Message = require('./models/Message')
require('dotenv').config();

const db = process.env.MONGODB_URL;

const app = express();

const port = process.env.PORT || 3000;
const server = app.listen(port, (err) => {
    console.log(`API listening on ${port}!`);
    if (err) throw err;
});

const io = socketIO(server, { cors: true, origins: '*:*' });

const indexRouter = require('./routes/index');
const signinRouter = require('./routes/signin');
const usersRouter = require('./routes/users');
const messageRouter = require('./routes/messages');

mongoose.connect(db, { useUnifiedTopology: true, useNewUrlParser: true })
    .then(() => console.log('MongoDB Connected...'))
    .catch(err => console.log(err));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors());

app.use('/api', indexRouter);
app.use('/api/users/signin', signinRouter);
app.use('/api/users', usersRouter);
app.use('/api/messages', messageRouter);

io.on('connection', socket => {
    let socketId = ""
    console.log('a user connected: ' + socket.id);
    socket.on('disconnect', reason => {
        let user = await User.findOne({ socket_id: socket.id })
        user.updateOne({ socket_id: "" })
    })
    socket.on('send-message', async(msg) => {
        msg = JSON.parse(msg)
        let user = await User.findOne({ access_token: msg.access_token })
        if (user.username == msg.sender) {
            let message = new Message({
                date: msg.date,
                sender: msg.sender,
                receiver: msg.receiver,
                type: msg.type,
                message: msg.message,
                conversation_id: msg.conversation_id
            })
            message.save()
            let receiver = await User.findOne({ username: msg.receiver })
            if (receiver.socket_id) {
                io.to(receiver.socket_id).emit('receive-message', message);
            } else {
                console.log('User offline')
            }
        } else {
            console.log('denied')
        }
    });

});



module.exports = app;