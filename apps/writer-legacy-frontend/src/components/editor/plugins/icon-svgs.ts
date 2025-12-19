// SVG content from solid-icons for use in ProseMirror plugins
// These match the icons used throughout the app

export const iconSvgs = {
  // Movement icons (from solid-icons/fi)
  arrowUp: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7"></path>
  </svg>`,

  arrowDown: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"></path>
  </svg>`,

  plus: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
  </svg>`,

  trash: `<svg fill="none" stroke-width="2" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" style="overflow: visible; color: currentcolor;" height="1em" width="1em"><path d="M3 6 5 6 21 6"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`,

  eye: `<svg fill="currentColor" stroke-width="0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" style="overflow: visible; color: currentcolor;" height="1em" width="1em"><path d="M942.2 486.2C847.4 286.5 704.1 186 512 186c-192.2 0-335.4 100.5-430.2 300.3a60.3 60.3 0 0 0 0 51.5C176.6 737.5 319.9 838 512 838c192.2 0 335.4-100.5 430.2-300.3 7.7-16.2 7.7-35 0-51.5zM512 766c-161.3 0-279.4-81.8-362.7-254C232.6 339.8 350.7 258 512 258c161.3 0 279.4 81.8 362.7 254C791.5 684.2 673.4 766 512 766zm-4-430c-97.2 0-176 78.8-176 176s78.8 176 176 176 176-78.8 176-176-78.8-176-176-176zm0 288c-61.9 0-112-50.1-112-112s50.1-112 112-112 112 50.1 112 112-50.1 112-112 112z"></path></svg>`,

  // AI tools (from various solid-icons packages)
  magicWand: `<svg fill="currentColor" stroke-width="0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" style="overflow: visible; color: currentcolor;" height="1em" width="1em"><path fill="currentColor" d="M4 3 2 1H1v1l2 2zm1-3h1v2H5zm4 5h2v1H9zm1-3V1H9L7 3l1 1zM0 5h2v1H0zm5 4h1v2H5zM1 9v1h1l2-2-1-1zm14.781 4.781L5.842 3.842a.752.752 0 0 0-1.061 0l-.939.939a.752.752 0 0 0 0 1.061l9.939 9.939a.752.752 0 0 0 1.061 0l.939-.939a.752.752 0 0 0 0-1.061zM7.5 8.5l-3-3 1-1 3 3-1 1z"></path></svg>`,

  spellCheck: `<svg fill="currentColor" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
    <path d="M10.854 7.146a.5.5 0 0 1 0 .708l-3 3a.5.5 0 0 1-.708 0l-1.5-1.5a.5.5 0 1 1 .708-.708L7.5 9.793l2.646-2.647a.5.5 0 0 1 .708 0z"></path>
    <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"></path>
    <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"></path>
  </svg>`,

  rewrite: `<svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M18.125 1H5.875A.875.875 0 0 0 5 1.875v20.25c0 .483.392.875.875.875h12.25a.875.875 0 0 0 .875-.875V1.875A.875.875 0 0 0 18.125 1zM17.25 21.25H6.75V2.75h10.5v18.5z"></path>
    <path d="M8.5 6.5h7a.5.5 0 0 0 0-1h-7a.5.5 0 0 0 0 1zm0 3h7a.5.5 0 0 0 0-1h-7a.5.5 0 0 0 0 1zm0 3h7a.5.5 0 0 0 0-1h-7a.5.5 0 0 0 0 1zm0 3h4a.5.5 0 0 0 0-1h-4a.5.5 0 0 0 0 1z"></path>
  </svg>`,

  star: `<svg fill="currentColor" stroke-width="0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" style="overflow: visible; color: currentcolor;" height="1em" width="1em"><path d="m908.1 353.1-253.9-36.9L540.7 86.1c-3.1-6.3-8.2-11.4-14.5-14.5-15.8-7.8-35-1.3-42.9 14.5L369.8 316.2l-253.9 36.9c-7 1-13.4 4.3-18.3 9.3a32.05 32.05 0 0 0 .6 45.3l183.7 179.1-43.4 252.9a31.95 31.95 0 0 0 46.4 33.7L512 754l227.1 119.4c6.2 3.3 13.4 4.4 20.3 3.2 17.4-3 29.1-19.5 26.1-36.9l-43.4-252.9 183.7-179.1c5-4.9 8.3-11.3 9.3-18.3 2.7-17.5-9.5-33.7-27-36.3z"></path></svg>`,

  // Context tools
  building: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
  </svg>`,

  timeline: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
  </svg>`,

  // More action icons
  textEdit: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
  </svg>`,

  person: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
  </svg>`,

  language: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path stroke-linecap="round" stroke-linejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"></path>
  </svg>`,

  split: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path stroke-linecap="round" stroke-linejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path>
  </svg>`,

  // Text icons for state buttons - simple text in circles
  textD: `<svg fill="none" stroke-width="2" xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-letter-d" width="1em" height="1em" viewBox="0 0 24 24" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" style="overflow: visible; color: currentcolor;"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><path d="M7 4h6a5 5 0 0 1 5 5v6a5 5 0 0 1 -5 5h-6v-16"></path></svg>`,

  textR: `<svg fill="none" stroke-width="2" xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-letter-r" width="1em" height="1em" viewBox="0 0 24 24" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" style="overflow: visible; color: currentcolor;"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><path d="M7 20v-16h5.5a4 4 0 0 1 0 9h-5.5"></path><path d="M12 13l5 7"></path></svg>`,

  textA: `<svg fill="none" stroke-width="2" xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-letter-a" width="1em" height="1em" viewBox="0 0 24 24" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" style="overflow: visible; color: currentcolor;"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><path d="M7 20v-12a4 4 0 0 1 4 -4h2a4 4 0 0 1 4 4v12"></path><path d="M7 13l10 0"></path></svg>`,

  textF: `<svg fill="none" stroke-width="2" xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-letter-f" width="1em" height="1em" viewBox="0 0 24 24" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" style="overflow: visible; color: currentcolor;"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><path d="M17 4h-10v16"></path><path d="M7 12l8 0"></path></svg>`,
}

// Helper function to create an icon element
export function createIcon(iconName: keyof typeof iconSvgs, size = 16): HTMLElement {
  const span = document.createElement('span')
  span.style.cssText = `
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: ${size}px;
    height: ${size}px;
  `
  span.innerHTML = iconSvgs[iconName]

  // Style the SVG
  const svg = span.querySelector('svg')
  if (svg) {
    svg.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      flex-shrink: 0;
    `
  }

  return span
}
