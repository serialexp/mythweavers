import { ImageCropper, type ImageCropperRef } from '@mythweavers/image-cropper'
import { Button, Modal } from '@mythweavers/ui'
import type { Component } from 'solid-js'
import * as styles from './ImageCropModal.css'

export interface ImageCropModalProps {
  /** Whether the modal is open */
  isOpen: boolean
  /** The image source to crop */
  imageSrc: string | null
  /** Called when the user confirms the crop */
  onConfirm: (croppedImage: string) => void
  /** Called when the user cancels */
  onCancel: () => void
  /** Aspect ratio for the crop area (default: 1 for square) */
  aspectRatio?: number
  /** Whether to show a circular crop area (default: true for avatars) */
  circular?: boolean
  /** Output size in pixels (default: 256) */
  outputSize?: number
}

export const ImageCropModal: Component<ImageCropModalProps> = (props) => {
  let cropperRef: ImageCropperRef | undefined

  const handleConfirm = () => {
    if (!cropperRef) return
    try {
      const croppedImage = cropperRef.getCroppedImage()
      props.onConfirm(croppedImage)
    } catch (err) {
      console.error('Failed to crop image:', err)
    }
  }

  return (
    <Modal
      open={props.isOpen && props.imageSrc !== null}
      onClose={props.onCancel}
      title="Crop Image"
      size="md"
      footer={
        <div class={styles.actions}>
          <Button variant="secondary" onClick={props.onCancel}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleConfirm}>
            Apply
          </Button>
        </div>
      }
    >
      <div class={styles.modalContent}>
        <p class={styles.instructions}>
          Drag to pan, scroll to zoom. Position the image within the crop area.
        </p>
        <div class={styles.cropperContainer}>
          {props.imageSrc && (
            <ImageCropper
              src={props.imageSrc}
              aspectRatio={props.aspectRatio ?? 1}
              circular={props.circular ?? true}
              outputSize={props.outputSize ?? 256}
              width={300}
              height={300}
              showZoomSlider={true}
              ref={(ref) => (cropperRef = ref)}
            />
          )}
        </div>
      </div>
    </Modal>
  )
}
