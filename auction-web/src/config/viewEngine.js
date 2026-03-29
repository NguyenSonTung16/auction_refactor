import {hbsHelper} from '../helpers/handlebars.helper.js';
import { engine } from 'express-handlebars';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const viewPath = path.join(__dirname, '../views');

const setUpViewEngine =(app) =>{
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

// Tạo thư mục uploads nếu chưa có
const uploadDir = path.join(viewPath, 'public', 'images', 'products');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
export default setUpViewEngine;