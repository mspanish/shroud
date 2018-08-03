import roadtrip from 'roadtrip';
import IndexHandler from './pages/index/index.handler';
import AuthorsHandler from './pages/authors/authors.handler';
import CategoriesHandler from './pages/categories/categories.handler';
import NotebookHandler from './pages/notebook/notebook.handler';
//import SnippetsHandler from './pages/snippets/snippets.handler';
import AuthorDetailsHandler from './pages/author-details/author-details.handler';
import PostDetailsHandler from './pages/post-details/post-details.handler';
import CategoryDetailsHandler from './pages/category-details/category-details.handler';


export default class Routes {
  constructor() {
    this.router = roadtrip;
    this.init();
  }

  init() {
    this.index_handler = new IndexHandler();
    this.authors_handler = new AuthorsHandler();
    this.categories_handler = new CategoriesHandler();
    this.notebook_handler = new NotebookHandler();   
    this.post_details_handler = new PostDetailsHandler();
    this.author_details_handler = new AuthorDetailsHandler();
    this.category_details_handler = new CategoryDetailsHandler();

    this.router
      .add('/', this.index_handler.route)
     // .add('/snippets', this.snippets_handler.route)
     // .add('/snippets/:id', this.snippet_details_handler.route)  
      .add('/topics/:id', this.post_details_handler.route)      
      .add('/notebook', this.notebook_handler.route) 

      .add('/categories', this.categories_handler.route) 
      .add('/categories/:id', this.category_details_handler.route)

      .add('/authors', this.authors_handler.route)   
      .add('/authors/:id', this.author_details_handler.route)
      
      .start({
        fallback: '/'
      });
  }
}