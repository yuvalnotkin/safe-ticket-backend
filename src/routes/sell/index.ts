import { Router } from 'express';
import startAuthRouter from './start-auth';
import mockProviderRouter from './mock-provider';
import callbackRouter from './callback';
import ticketsRouter from './tickets';
import createListingRouter from './create-listing';

const router = Router();

router.use(startAuthRouter);
router.use(mockProviderRouter);
router.use(callbackRouter);
router.use(ticketsRouter);
router.use(createListingRouter);

export default router;
