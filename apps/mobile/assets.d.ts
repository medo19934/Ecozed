// Static images bundled by Metro (resolved to an asset reference for <Image source>).
// Ambient wildcard module: must stay a script file (no top-level import).
declare module '*.png' {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const value: import('react-native').ImageSourcePropType;
  export default value;
}
