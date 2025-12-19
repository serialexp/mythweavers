# Media Attachments System

Generic system for attaching media (video transcripts, audio, image sequences) to stories and scenes.

## Design Goals

1. **User-provided URLs** - Users upload media elsewhere and provide publicly accessible URLs
2. **Generic format** - Works for video, audio, image sequences, or any timestamped media
3. **Transcript-based** - Focus on text transcripts with optional visual/audio references
4. **Scene linking** - Easy to link media segments to story scenes

## Use Cases

### Video Source Material
User has a TV episode they want to write a novelization of:
1. Use external tool to extract frames and transcript (e.g., video-analyzer, Whisper, etc.)
2. Upload frames to image hosting (Imgur, CDN, S3, etc.)
3. Create MediaAttachment with transcript + frame URLs
4. Link segments to scenes as they write

### Audio Source
User has a podcast/audiobook to adapt:
1. Generate transcript (Whisper, Rev.ai, etc.)
2. Upload media metadata with transcript segments
3. Link to scenes during writing

### Image Sequence
User has comic panels, storyboards, or concept art:
1. Upload images to hosting service
2. Create MediaAttachment with image URLs
3. Associate with relevant scenes

## Data Model

### MediaAttachment
Main container for a piece of media (episode, audio file, etc.)

```typescript
{
  id: string
  storyId: string
  name: string                    // "Star Wars: Clone Wars S01E02"
  description?: string            // Optional description
  mediaType: string               // 'video' | 'audio' | 'image-sequence' | 'custom'
  duration?: number               // Duration in seconds (if applicable)
  createdAt: DateTime
  updatedAt: DateTime
}
```

### MediaFrame
Individual frames/images extracted from media

```typescript
{
  id: string
  mediaAttachmentId: string
  frameNumber: int                // Sequential frame number
  timestamp: float                // Timestamp in seconds (e.g., 45.2)
  imageUrl: string                // User-provided URL: "https://i.imgur.com/abc123.jpg"
  description?: string            // Optional description
  createdAt: DateTime
}
```

**User responsibility:** Host images somewhere and provide URLs

### MediaSegment
Transcript segments with timestamps

```typescript
{
  id: string
  mediaAttachmentId: string
  segmentIndex: int               // Sequential segment number
  startTime: float                // Start timestamp (e.g., 12.5)
  endTime: float                  // End timestamp (e.g., 18.3)
  text: string                    // "The Republic forces are gathering near the Rishi moon."
  speaker?: string                // "Anakin Skywalker" (if speaker diarization available)
  videoUrl?: string               // Optional: URL to video clip for this segment
  createdAt: DateTime
}
```

**User responsibility:** Generate transcript and optionally host video segments

### MediaSceneLink
Links media segments to story scenes

```typescript
{
  id: string
  mediaAttachmentId: string
  sceneId: string
  startTime?: float               // Optional: specific start time in media
  endTime?: float                 // Optional: specific end time in media
  notes?: string                  // "This segment inspired the opening"
  createdAt: DateTime
}
```

## API Endpoints

### List Media Attachments
```
GET /stories/:storyId/media
```

Response:
```json
{
  "media": [
    {
      "id": "abc123",
      "name": "Clone Wars S01E02 - Rising Malevolence",
      "mediaType": "video",
      "duration": 1320.5,
      "frameCount": 245,
      "segmentCount": 89,
      "linkedScenes": 12,
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ]
}
```

### Create Media Attachment
```
POST /stories/:storyId/media
```

Request body:
```json
{
  "name": "Clone Wars S01E02 - Rising Malevolence",
  "description": "Episode about Malevolence ship attacking Republic fleet",
  "mediaType": "video",
  "duration": 1320.5,
  "frames": [
    {
      "frameNumber": 1,
      "timestamp": 0.0,
      "imageUrl": "https://i.imgur.com/frame001.jpg"
    },
    {
      "frameNumber": 2,
      "timestamp": 5.4,
      "imageUrl": "https://i.imgur.com/frame002.jpg",
      "description": "Opening shot of space"
    }
    // ... more frames
  ],
  "segments": [
    {
      "segmentIndex": 0,
      "startTime": 0.0,
      "endTime": 5.2,
      "text": "A long time ago in a galaxy far, far away...",
      "speaker": "Narrator"
    },
    {
      "segmentIndex": 1,
      "startTime": 5.2,
      "endTime": 12.8,
      "text": "The Republic forces are gathering near the Rishi moon.",
      "speaker": "Anakin Skywalker",
      "videoUrl": "https://example.com/segments/segment_001.mp4"
    }
    // ... more segments
  ]
}
```

Response:
```json
{
  "id": "abc123",
  "message": "Media attachment created with 245 frames and 89 segments"
}
```

### Get Media Details
```
GET /stories/:storyId/media/:id
```

Response:
```json
{
  "id": "abc123",
  "name": "Clone Wars S01E02 - Rising Malevolence",
  "mediaType": "video",
  "duration": 1320.5,
  "frames": [
    {
      "id": "frame1",
      "frameNumber": 1,
      "timestamp": 0.0,
      "imageUrl": "https://i.imgur.com/frame001.jpg"
    }
    // ... more frames
  ],
  "segments": [
    {
      "id": "seg1",
      "segmentIndex": 0,
      "startTime": 0.0,
      "endTime": 5.2,
      "text": "A long time ago in a galaxy far, far away...",
      "speaker": "Narrator"
    }
    // ... more segments
  ],
  "linkedScenes": [
    {
      "sceneId": "scene123",
      "sceneName": "Opening Battle",
      "startTime": 45.0,
      "endTime": 120.5,
      "notes": "This battle inspired the scene"
    }
  ]
}
```

### Update Media Attachment
```
PUT /stories/:storyId/media/:id
```

Can update name, description, or add/remove frames/segments.

### Delete Media Attachment
```
DELETE /stories/:storyId/media/:id
```

### Link Media to Scene
```
POST /stories/:storyId/media/:mediaId/link-scene
```

Request body:
```json
{
  "sceneId": "scene123",
  "startTime": 45.0,        // Optional: specific time range in media
  "endTime": 120.5,
  "notes": "This segment inspired the opening battle scene"
}
```

### Unlink Media from Scene
```
DELETE /stories/:storyId/media/:mediaId/link-scene/:sceneId
```

## Upload Format Specification

For users who want to batch upload media, we can accept JSON format:

```json
{
  "name": "Episode Name",
  "description": "Optional description",
  "mediaType": "video",
  "duration": 1320.5,
  "metadata": {
    "source": "video-analyzer",
    "version": "1.0",
    "processedAt": "2025-01-01T00:00:00Z"
  },
  "frames": [
    {
      "number": 1,
      "timestamp": 0.0,
      "imageUrl": "https://i.imgur.com/frame001.jpg",
      "description": "Optional description"
    }
  ],
  "transcript": {
    "segments": [
      {
        "index": 0,
        "start": 0.0,
        "end": 5.2,
        "text": "Transcript text here",
        "speaker": "Speaker name (optional)",
        "videoUrl": "https://example.com/segment.mp4 (optional)"
      }
    ]
  }
}
```

## Frontend Integration

### Media Browser Component
```typescript
<MediaBrowser storyId={storyId}>
  <MediaList />
  <MediaViewer
    frames={frames}
    transcript={segments}
    currentTime={currentTime}
  />
</MediaBrowser>
```

### Scene Editor Integration
```typescript
<SceneEditor sceneId={sceneId}>
  <LinkedMedia>
    {/* Show linked media segments */}
    <MediaSegment
      text="The Republic forces are gathering..."
      timestamp="12.5s"
      speaker="Anakin"
      frame={<img src="https://i.imgur.com/frame.jpg" />}
    />
  </LinkedMedia>
</SceneEditor>
```

## Benefits

1. **No file storage** - Users host media elsewhere, we just store metadata + URLs
2. **Flexible** - Works with any media type (video, audio, images)
3. **Lightweight** - Just storing text and URLs, not large binary files
4. **Easy to link** - Simple associations between media and scenes
5. **Portable** - Users can migrate their media URLs if needed
6. **Tool-agnostic** - Users can use any tool to generate transcripts/frames

## Future Enhancements

- [ ] Support for embedded timecodes in transcript text (e.g., `[00:12.5]`)
- [ ] Auto-matching frames to transcript segments by timestamp
- [ ] Search transcripts across all media attachments
- [ ] Export scenes with linked media references
- [ ] Media timeline view showing all attachments chronologically
- [ ] Support for subtitle formats (SRT, VTT, etc.)
