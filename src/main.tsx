import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { MarketProvider } from './state/MarketContext'
import App from './app/App'
import './styles/global.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <MarketProvider>
        <App />
      </MarketProvider>
    </BrowserRouter>
  </StrictMode>
)
