import dotenv from "dotenv";
import process from "process";
import path from "path";

export const loadConfig = () => {
  const nodeEnv = process.env.NODE_ENV;
  const filepath = nodeEnv
    ? path.join(process.cwd(), `.env.${nodeEnv}`)
    : path.join(process.cwd(), ".env");
  dotenv.config({ path: filepath });
};
