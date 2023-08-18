import { IncomingMessage, ServerResponse, createServer } from 'http';
// import { promises as fs } from 'fs';
import { Server } from 'socket.io';
import { createRecipe, getRecipes, getRegions } from './db';
import * as serveStatic from 'serve-static';

const serve = serveStatic('static', { 'index': ['recipeGenerator.html'], /*fallthrough: false  does not work*/});
// const host = 'localhost';
const port = 8080;


async function main() {
	const requestListener = async function (req: IncomingMessage, res: ServerResponse) {
		console.log(req.url)
		serve(req, res, (e) => {
			console.log('fallthrough', req.url, e);
			return;
			if (res.writableEnded) return;
			if (!res.headersSent) res.writeHead(404, 'text/html');
			if (res.writable)	res.end('not found');
		});
		// if (req.method !== 'GET') {
		// 	res.writeHead(401);
		// } else if (req.url !== '/index.html' && req.url !== '/') {
		// 	res.writeHead(404);
		// } else {
		// 	res.writeHead(200, '', { 'content-type': 'text/html; charset=utf-8' });
		// 	const index = "" + await fs.readFile('./static/stuff.html', { encoding: 'utf8' })
		// 	res.write(index);
		// }
		// res.end();
	};

	const server = createServer(requestListener);
	server.listen(port, () => {
		console.log(`Server is running on ${port}`);
	});

	const io = new Server({
		path: '/ws',
		serveClient: false,
		cookie: false,
	});

	io.attach(server, {
		pingInterval: 10000,
		pingTimeout: 5000,
		cookie: false
	});

	io.on('connection', socket =>{
		console.log('on connection')
		socket.on('request', onRequest)
	});
}

async function onRequest(data, cb){
	const func = data?.func;
	if (func === 'getRecipes') {
		const r = await getRecipes();
		cb(r);
	} 

	if (func === 'getRegions') {
		const r = await getRegions();
		cb(r);
	} 

	if (func === 'createRecipe') {
		const r = await createRecipe(data?.data);
		cb(r);
	} 
}


main();