import express from 'express';
import { 
    getAllTags,
    createTag,
    updateTag,
    deleteTag
} from '../controllers/tag.controller.js';
import { wrapAsync } from '../middlewares/error.middleware.js';
import { authMiddleware} from '../middlewares/auth.middleware.js';

const tagRoutes = express.Router();

// get all tags
tagRoutes.get('/', wrapAsync(getAllTags));

tagRoutes.use(authMiddleware);
// create new tag
tagRoutes.post('/create', wrapAsync(createTag));
// update tag by id
tagRoutes.put('/edit/:id', wrapAsync(updateTag));
// delete tag by id
tagRoutes.delete('/:id', wrapAsync(deleteTag));

export default tagRoutes;