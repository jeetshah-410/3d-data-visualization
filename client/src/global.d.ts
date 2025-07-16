/// <reference types="react-scripts" />

import * as ReactThreeFiber from '@react-three/fiber';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements extends ReactThreeFiber.JSX.IntrinsicElements {}
  }
}
