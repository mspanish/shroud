/*
 * This is the entrypoint of all the JavaScript files.
 */
//import Nav from './components/Nav.html';
import Menu from './components/Menu.html';
import { Store } from 'svelte/store.js';

import Routes from './routes';
//import './styles/_color_nav.css';


//const baseUrl = 'http://localhost:5100/';
//const baseUrl = 'https://es6.kwippe.com/';
//const urly = baseUrl+ 'data/snippets.json'
  
const store = new Store({
  snippets: []
});

// fetch(urly)
//   .then(res => res.json())
//   .then(data => {
//      const snippets = data.snippets;
//      store.set({baseUrl: baseUrl, snippets: snippets });
//     // console.table(store.get())
//   });  

document.addEventListener('DOMContentLoaded', main);

function main () {
  window.Routes = new Routes();

    // const nav = new Nav({
    //     target: document.getElementById('nav'),
    //     store
    // })

    const menu = new Menu({
      target: document.getElementById('menu'),
      store
    })

}
window.store = store; // useful for debugging!