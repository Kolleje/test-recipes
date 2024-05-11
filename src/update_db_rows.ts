
import { Database } from 'sqlite3';

const dbfile = './db/mostbasic3.sqlite';

const text = 'aaaaaaaaabbbbbbbbcccccccccccddddddddddddeeeeeeeeeeeee';

async function main() {
	const db = new Database(dbfile, err => console.log);
	const result = await  fromCallback(cb => db.all('SELECT * FROM test',cb));
	console.log(result);
	let i = 10000;
	while (i < 200000) {
		await fromCallback(cb => db.run(`insert into test (value, text) values (${i},"${text}")`,cb));
		i++
	}
}

async function fromCallback(fn){
	return new Promise((r,j) => {
		const cb = function(err, result){
			if (err) return j(err);
			r(result);
		}
		fn(cb);
	})
}

main();