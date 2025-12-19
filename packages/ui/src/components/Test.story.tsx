// Simple test story without vanilla-extract to verify plugin works
export default (props: { Hst: any }) => {
  const { Hst } = props

  return (
    <Hst.Story title="Test Component" group="components">
      <Hst.Variant title="Basic">
        <div>
          <h1>Hello from Solid!</h1>
          <p>This is a test component</p>
        </div>
      </Hst.Variant>

      <Hst.Variant title="With Button">
        <button>Click me</button>
      </Hst.Variant>
    </Hst.Story>
  )
}
