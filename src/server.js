import sirv from 'sirv';
import compression from 'compression';
import * as sapper from '@sapper/server';
import socketIo from 'socket.io';
import express from 'express';
import socket from '../socket';

const { PORT, NODE_ENV } = process.env;
const dev = NODE_ENV === 'development';

const app = express();

const server = app
    .use(
        compression({ threshold: 0 }),
        sirv('static', { dev }),
        sapper.middleware()
    )
    .listen(PORT, err => {
        if (err) console.log('error', err);
    });

const io = socketIo(server, {
  cors: {
    origin: PORT,
    methods: ["GET", "POST"],
    transports: ["websocket", 'polling']
  }
});
socket(io)