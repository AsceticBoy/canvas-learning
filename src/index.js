import React, { Component } from 'react'
import PropTypes from 'prop-types'
import ReactDOM from 'react-dom'
var Promise = require('es6-promise-polyfill').Promise

class App extends Component {
  static propTypes = {
    name: PropTypes.string
  }

  componentDidMount() {
    try{
      var a = new Promise(function(resolve, reject) {
        reject('error')
      })
      console.log(a)
    }catch(e){
      console.log(111)
    }
  }

  render() {
    return <div> hello { this.props.name } </div>
  }
}

const app = document.body.querySelector('#app')
ReactDOM.render(<App name='canvas'/>, app)