import { trpc } from '../utils/trpc' // Adjust the import path based on your project structure

export const AdminPage = () => {
  const randomizeOrderMutation = trpc.randomizeOrder.useMutation()

  const handleRandomizeOrder = async () => {
    try {
      await randomizeOrderMutation.mutateAsync()
      alert('Order randomized successfully!')
    } catch (error) {
      console.error('Failed to randomize order:', error)
      alert('Failed to randomize order.')
    }
  }

  return (
    <div>
      <h1>Admin Page</h1>
      <button
        type="button"
        className="btn btn-primary btn-loading"
        onClick={handleRandomizeOrder}
        disabled={randomizeOrderMutation.isPending}
      >
        {randomizeOrderMutation.isPending ? <span className="loading loading-spinner" /> : null}
        Randomize Order
      </button>
    </div>
  )
}

export default AdminPage
