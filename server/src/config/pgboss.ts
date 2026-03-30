import { PgBoss } from "pg-boss";
import env from "./env";

const boss = new PgBoss(env.databaseUrl);

export default boss;
