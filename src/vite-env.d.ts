/// <reference types="vite/client" />

// Type declaration for importing WGSL shader files as raw strings
declare module '*.wgsl?raw' {
  const content: string;
  export default content;
}

declare module '*.wgsl' {
  const content: string;
  export default content;
}
