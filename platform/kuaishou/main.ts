import readme from './readme.json';
import modules from './modules/index';
import { runApp } from '../../scripts/runner-main';

runApp(readme, modules).catch((err) => {
  console.error('Unhandled main exception:', err);
  process.exit(1);
});

