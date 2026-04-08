import { ThemeProvider } from "@mythweavers/ui"
import { Route, Router, Navigate } from "@solidjs/router"
import { render } from "solid-js/web"
import { App } from "./App"
import { ProviderDetailPage } from "./pages/ProviderDetailPage"
import { ProvidersPage } from "./pages/ProvidersPage"
import { UsersPage } from "./pages/UsersPage"
import "./index.css"

render(
  () => (
    <ThemeProvider defaultTheme="chronicle">
      <Router root={App}>
        <Route path="/" component={() => <Navigate href="/providers" />} />
        <Route path="/providers" component={ProvidersPage} />
        <Route path="/providers/:id" component={ProviderDetailPage} />
        <Route path="/users" component={UsersPage} />
      </Router>
    </ThemeProvider>
  ),
  document.getElementById("root")!,
)
