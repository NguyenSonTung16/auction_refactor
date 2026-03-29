import {hbsHelper} from '../helpers/handlebars.helper.js';
import { engine } from 'express-handlebars';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const setUpViewEngine =(app) =>{
    const viewPath = path.join(__dirname, '../views');
    app.engine('handlebars', engine({
      defaultLayout: 'main',
      helpers: hbsHelper,
      partialsDir: [
            path.join(viewPath, 'partials'), 
            path.join(viewPath, 'vwAccount') 
      ]
    }));
    app.set('view engine', 'handlebars');
    app.set('views', viewPath);
}
export default setUpViewEngine;