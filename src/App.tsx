import './App.css'
import { LanguageProvider } from './contexts/LanguageContext'
import { ShoppingProvider } from './contexts/ShoppingContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { UsersProvider } from './contexts/UsersContext'
import { WidthProvider } from './contexts/WidthContext'
import AppRouter from './router/AppRouter'

function App() {
  return (
    <LanguageProvider>
      <WidthProvider>
        <ThemeProvider>
          <ShoppingProvider>
            <UsersProvider>
            <AppRouter>
            
            </AppRouter>
            </UsersProvider>
          </ShoppingProvider>
        </ThemeProvider>
      </WidthProvider>  
    </LanguageProvider>
  )
}

export default App
