import { ThemeComparison } from '../../story-utils/ThemeComparison'
import { Button } from '../Button'
import { NavBar, NavBarActions, NavBarBrand, NavBarNav, NavLink } from './NavBar'

// Simple icon components for demo
const SearchIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="11" cy="11" r="8" />
    <path d="M21 21l-4.35-4.35" />
  </svg>
)

const UserIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)

export default (props: { Hst: any }) => {
  const { Hst } = props

  return (
    <Hst.Story title="NavBar" group="components">
      <Hst.Variant title="Default">
        <ThemeComparison>
          <NavBar>
            <NavBarBrand href="#">MyApp</NavBarBrand>
            <NavBarNav>
              <NavLink href="#" active>Home</NavLink>
              <NavLink href="#">About</NavLink>
              <NavLink href="#">Services</NavLink>
              <NavLink href="#">Contact</NavLink>
            </NavBarNav>
            <NavBarActions>
              <Button variant="ghost" size="sm">Login</Button>
              <Button size="sm">Sign Up</Button>
            </NavBarActions>
          </NavBar>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Elevated">
        <ThemeComparison>
          <NavBar variant="elevated">
            <NavBarBrand href="#">MyApp</NavBarBrand>
            <NavBarNav>
              <NavLink href="#" active>Home</NavLink>
              <NavLink href="#">About</NavLink>
              <NavLink href="#">Services</NavLink>
            </NavBarNav>
            <NavBarActions>
              <Button variant="ghost" size="sm">
                <SearchIcon />
              </Button>
              <Button variant="ghost" size="sm">
                <UserIcon />
              </Button>
            </NavBarActions>
          </NavBar>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Transparent">
        <ThemeComparison>
          <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '0' }}>
            <NavBar variant="transparent">
              <NavBarBrand href="#">MyApp</NavBarBrand>
              <NavBarNav>
                <NavLink href="#">Home</NavLink>
                <NavLink href="#">About</NavLink>
                <NavLink href="#">Contact</NavLink>
              </NavBarNav>
              <NavBarActions>
                <Button variant="ghost" size="sm">Login</Button>
              </NavBarActions>
            </NavBar>
          </div>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Sizes">
        <ThemeComparison>
          <div style={{ display: 'flex', 'flex-direction': 'column', gap: '16px' }}>
            <NavBar size="sm">
              <NavBarBrand href="#">Small</NavBarBrand>
              <NavBarNav>
                <NavLink href="#">Link</NavLink>
              </NavBarNav>
            </NavBar>
            <NavBar size="md">
              <NavBarBrand href="#">Medium</NavBarBrand>
              <NavBarNav>
                <NavLink href="#">Link</NavLink>
              </NavBarNav>
            </NavBar>
            <NavBar size="lg">
              <NavBarBrand href="#">Large</NavBarBrand>
              <NavBarNav>
                <NavLink href="#">Link</NavLink>
              </NavBarNav>
            </NavBar>
          </div>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Active Link States">
        <ThemeComparison>
          <NavBar>
            <NavBarBrand href="#">MyApp</NavBarBrand>
            <NavBarNav>
              <NavLink href="#" active>Active</NavLink>
              <NavLink href="#">Inactive</NavLink>
              <NavLink href="#">Inactive</NavLink>
            </NavBarNav>
          </NavBar>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Brand Only">
        <ThemeComparison>
          <NavBar>
            <NavBarBrand href="#">Brand Only NavBar</NavBarBrand>
          </NavBar>
        </ThemeComparison>
      </Hst.Variant>
    </Hst.Story>
  )
}
