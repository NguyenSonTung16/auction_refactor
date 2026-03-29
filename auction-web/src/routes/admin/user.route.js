import express from 'express';
import * as userController from '../../controllers/admin/user.controllers.js';

const router = express.Router();

router.get('/list', userController.getList);
router.get('/detail/:id', userController.getDetailById);
router.get('/add', userController.getAddPage);
router.post('/add', userController.postAdd);
router.get('/edit/:id', userController.getEditPage);
router.post('/edit', userController.postEdit);
router.post('/reset-password', userController.postResetPassword);
router.post('/delete', userController.postDelete);
router.get('/upgrade-requests', userController.getUpgradeRequests);
router.post('/upgrade/approve', userController.postUpgradeApprove);
router.post('/upgrade/reject', userController.postUpgradeReject);

export default router;
