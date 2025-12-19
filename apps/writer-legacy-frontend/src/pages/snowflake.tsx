import { Component } from 'solid-js'
import { WriteHeaderMenu } from '../components/WriteHeaderMenu'
import { SnowflakeView } from '../components/snowflake/SnowflakeView'

const Snowflake: Component = () => {
  return (
    <div class="flex flex-col h-full">
      <WriteHeaderMenu />
      <div class="flex-1 relative overflow-auto">
        <SnowflakeView />
      </div>
    </div>
  )
}

export default Snowflake
