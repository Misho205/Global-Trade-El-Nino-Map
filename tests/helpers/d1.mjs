import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
export function fixtureD1(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');
 for(const f of readdirSync(new URL('../../drizzle/',import.meta.url)).filter(x=>x.endsWith('.sql')).sort())sqlite.exec(readFileSync(new URL('../../drizzle/'+f,import.meta.url),'utf8'));
 const execute=(sql,args)=>{const statement=sqlite.prepare(sql);return statement.columns().length?{results:statement.all(...args),meta:{changes:0}}:{results:[],meta:{changes:Number(statement.run(...args).changes)}};};
 const db={prepare(sql){let args=[];return {sql,get args(){return args;},bind(...values){args=values;return this;},async first(){return execute(sql,args).results[0]??null;},async all(){return execute(sql,args);},async run(){return execute(sql,args);}};},async batch(statements){sqlite.exec('BEGIN IMMEDIATE');try{const results=statements.map(s=>execute(s.sql,s.args));sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
 return {sqlite,db};
}