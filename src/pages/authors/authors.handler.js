import Authors from './authors.html';

export default class AuthorsHandler {
  get route() {
    return {
      enter(current, previous) {
        this.component = new Authors({
          target: document.getElementById('app'),
          data: {
            name: 'world'
          }
        })
        console.log('Entered authors!');
      },
      leave(current, previous) {
        this.component.destroy();
        console.log('Left authors!');
      }
    }
  }
}