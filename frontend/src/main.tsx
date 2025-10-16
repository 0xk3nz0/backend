import React from 'react'
import ReactDOM from 'react-dom/client'
import PongGame from './app'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PongGame />
  </React.StrictMode>,
)
