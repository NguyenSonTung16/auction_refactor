import multer from 'multer';
import path from 'path';
import fs from 'fs';
import * as productModel from '../models/product.model.js';

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

export const upload = multer({ storage: storage });

export async function processProductImages(productId, tempThumbnailPath, tempSubimagePaths) {
    const dirPath = path.join('public', 'images', 'products').replace(/\\/g, "/");

    // Ensure directory exists
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }

    // Process Thumbnail
    const mainPath = path.join(dirPath, `p${productId}_thumb.jpg`).replace(/\\/g, "/");
    const oldMainPath = path.join('public', 'uploads', path.basename(tempThumbnailPath)).replace(/\\/g, "/");
    const savedMainPath = '/' + path.join('images', 'products', `p${productId}_thumb.jpg`).replace(/\\/g, "/");
    
    if (fs.existsSync(oldMainPath)) {
        fs.renameSync(oldMainPath, mainPath);
        await productModel.updateProductThumbnail(productId, savedMainPath);
    }

    // Process Subimages
    let i = 1;
    let newImgPaths = [];
    for (const imgPath of tempSubimagePaths) {
        const oldPath = path.join('public', 'uploads', path.basename(imgPath)).replace(/\\/g, "/");
        const newPath = path.join(dirPath, `p${productId}_${i}.jpg`).replace(/\\/g, "/");
        const savedPath = '/' + path.join('images', 'products', `p${productId}_${i}.jpg`).replace(/\\/g, "/");
        
        if (fs.existsSync(oldPath)) {
            fs.renameSync(oldPath, newPath);
            newImgPaths.push({
                product_id: productId,
                img_link: savedPath
            });
            i++;
        }
    }

    if (newImgPaths.length > 0) {
        await productModel.addProductImages(newImgPaths);
    }
    
    return true;
}

export async function processUserAvatar(userId, tempAvatarPath) {
    const dirPath = path.join('public', 'images', 'users').replace(/\\/g, "/");

    // Ensure directory exists
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }

    // Process Avatar
    const newFileName = `u${userId}_avatar${path.extname(tempAvatarPath)}`;
    const newPath = path.join(dirPath, newFileName).replace(/\\/g, "/");
    const oldPath = path.join('public', 'uploads', path.basename(tempAvatarPath)).replace(/\\/g, "/");
    const savedPath = '/' + path.join('images', 'users', newFileName).replace(/\\/g, "/");
    
    if (fs.existsSync(oldPath)) {
        fs.renameSync(oldPath, newPath);
        return savedPath;
    }
    return null;
}
