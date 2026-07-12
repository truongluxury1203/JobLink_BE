import express from 'express';
import { 
    getAllCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    getPopularCategories
} from '../controllers/category.controller.js';
import { wrapAsync } from '../middlewares/error.middleware.js';
import { authMiddleware} from '../middlewares/auth.middleware.js';
import { adminMiddleware } from '../middlewares/admin.middleware.js';

const categoryRouter = express.Router();


// Public route to get all categories
categoryRouter.get('/', wrapAsync(getAllCategories));

// Public route to get popular categories with openings count
categoryRouter.get('/popular', wrapAsync(getPopularCategories));

categoryRouter.use(authMiddleware, adminMiddleware);
// create new category
categoryRouter.post('/create', wrapAsync(createCategory));
// update category by id
categoryRouter.put('/edit/:id', wrapAsync(updateCategory));
// delete category by id
categoryRouter.delete('/:id', wrapAsync(deleteCategory));

export default categoryRouter;