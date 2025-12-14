import { Component, Show, createSignal, onMount } from 'solid-js'
import { storage } from '../utils/storage'
import { BsInfoCircle } from 'solid-icons/bs'
import styles from './StorageMigrationBanner.module.css'

export const StorageMigrationBanner: Component = () => {
  const [migrationStatus, setMigrationStatus] = createSignal<ReturnType<typeof storage.getMigrationStatus> | null>(null)
  const [isCleaningUp, setIsCleaningUp] = createSignal(false)
  const [showBanner, setShowBanner] = createSignal(false)

  onMount(() => {
    const status = storage.getMigrationStatus()
    setMigrationStatus(status)

    // Show banner if migration is done but cleanup hasn't happened
    // AND at least one item was actually migrated
    if (status.migrated && !status.cleanedUp && status.info?.migratedCount > 0) {
      setShowBanner(true)
    }
  })

  const handleCleanup = async () => {
    setIsCleaningUp(true)
    try {
      const result = await storage.cleanupAfterMigration()
      if (result.success) {
        alert(`✅ ${result.message}\n\nYour localStorage has been cleaned up successfully.`)
        setShowBanner(false)
        // Update status
        const newStatus = storage.getMigrationStatus()
        setMigrationStatus(newStatus)
      } else {
        alert(`❌ ${result.message}`)
      }
    } catch (error) {
      alert(`Error during cleanup: ${error}`)
    } finally {
      setIsCleaningUp(false)
    }
  }

  const dismissBanner = () => {
    setShowBanner(false)
  }

  return (
    <Show when={showBanner() && migrationStatus()}>
      <div class={styles.banner}>
        <div class={styles.content}>
          <div class={styles.icon}>
            <BsInfoCircle />
          </div>
          <div class={styles.message}>
            <div class={styles.title}>Storage Migration Complete</div>
            <div class={styles.description}>
              Your story data has been migrated to IndexedDB for better performance and more storage space.
              {migrationStatus()?.info && (
                <div class={styles.details}>
                  {migrationStatus()!.info.migratedCount} items migrated successfully
                  {migrationStatus()!.info.errors.length > 0 && (
                    <span class={styles.warning}>
                      {' '}({migrationStatus()!.info.errors.length} errors)
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <div class={styles.actions}>
            <button
              class={styles.confirmButton}
              onClick={handleCleanup}
              disabled={isCleaningUp()}
            >
              {isCleaningUp() ? 'Cleaning up...' : 'Confirm & Clean Up'}
            </button>
            <button
              class={styles.dismissButton}
              onClick={dismissBanner}
              disabled={isCleaningUp()}
            >
              Later
            </button>
          </div>
        </div>
      </div>
    </Show>
  )
}