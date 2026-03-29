import express from 'express';
import * as accountController from '../../controllers/admin/account.controllers.js';
const router = express.Router();

router.get('/profile', accountController.getProfile);

export default router;
