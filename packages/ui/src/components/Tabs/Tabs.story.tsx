import { ThemeComparison } from '../../story-utils/ThemeComparison'
import { Tab, TabList, TabPanel, Tabs } from './Tabs'

const UserIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)

const SettingsIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
  </svg>
)

const BellIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 01-3.46 0" />
  </svg>
)

export default (props: { Hst: any }) => {
  const { Hst } = props

  return (
    <Hst.Story title="Tabs" group="components">
      <Hst.Variant title="Underline (Default)">
        <ThemeComparison>
          <Tabs defaultTab="tab1">
            <TabList aria-label="Example tabs">
              <Tab id="tab1">Overview</Tab>
              <Tab id="tab2">Features</Tab>
              <Tab id="tab3">Pricing</Tab>
            </TabList>
            <TabPanel id="tab1">
              <p>Overview content goes here.</p>
            </TabPanel>
            <TabPanel id="tab2">
              <p>Features content goes here.</p>
            </TabPanel>
            <TabPanel id="tab3">
              <p>Pricing content goes here.</p>
            </TabPanel>
          </Tabs>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Pills">
        <ThemeComparison>
          <Tabs defaultTab="tab1" variant="pills">
            <TabList aria-label="Example tabs">
              <Tab id="tab1">Overview</Tab>
              <Tab id="tab2">Features</Tab>
              <Tab id="tab3">Pricing</Tab>
            </TabList>
            <TabPanel id="tab1">
              <p>Overview content goes here.</p>
            </TabPanel>
            <TabPanel id="tab2">
              <p>Features content goes here.</p>
            </TabPanel>
            <TabPanel id="tab3">
              <p>Pricing content goes here.</p>
            </TabPanel>
          </Tabs>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="With Icons">
        <ThemeComparison>
          <Tabs defaultTab="profile">
            <TabList aria-label="Settings tabs">
              <Tab id="profile" icon={<UserIcon />}>
                Profile
              </Tab>
              <Tab id="settings" icon={<SettingsIcon />}>
                Settings
              </Tab>
              <Tab id="notifications" icon={<BellIcon />}>
                Notifications
              </Tab>
            </TabList>
            <TabPanel id="profile">
              <p>Profile settings content.</p>
            </TabPanel>
            <TabPanel id="settings">
              <p>General settings content.</p>
            </TabPanel>
            <TabPanel id="notifications">
              <p>Notification preferences content.</p>
            </TabPanel>
          </Tabs>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="With Disabled Tab">
        <ThemeComparison>
          <Tabs defaultTab="tab1">
            <TabList aria-label="Example tabs">
              <Tab id="tab1">Active</Tab>
              <Tab id="tab2" disabled>
                Disabled
              </Tab>
              <Tab id="tab3">Another</Tab>
            </TabList>
            <TabPanel id="tab1">
              <p>First tab content.</p>
            </TabPanel>
            <TabPanel id="tab2">
              <p>This won't show (tab is disabled).</p>
            </TabPanel>
            <TabPanel id="tab3">
              <p>Third tab content.</p>
            </TabPanel>
          </Tabs>
        </ThemeComparison>
      </Hst.Variant>
    </Hst.Story>
  )
}
