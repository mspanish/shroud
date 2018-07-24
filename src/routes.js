import roadtrip from 'roadtrip';
import IndexHandler from './pages/index/index.handler';
import AuthorsHandler from './pages/authors/authors.handler';
//import SnippetsHandler from './pages/snippets/snippets.handler';
import AuthorDetailsHandler from './pages/author-details/author-details.handler';
import PostDetailsHandler from './pages/post-details/post-details.handler';

export default class Routes {
  constructor() {
    this.router = roadtrip;
    this.init();
  }

  init() {
    this.index_handler = new IndexHandler();
    this.authors_handler = new AuthorsHandler();
    this.post_details_handler = new PostDetailsHandler();
    this.author_details_handler = new AuthorDetailsHandler();

    this.router
      .add('/', this.index_handler.route)
     // .add('/snippets', this.snippets_handler.route)
     // .add('/snippets/:id', this.snippet_details_handler.route)  
      .add('/topics/:id', this.post_details_handler.route)      
      .add('/authors', this.authors_handler.route)   
      .add('/authors/:id', this.author_details_handler.route)
      .start({
        fallback: '/'
      });
  }
}