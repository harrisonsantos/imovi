/**
 * O app usa jsx "preserve" (Next); no Vitest o JSX vira React.createElement
 * clássico. Importe este módulo antes de qualquer componente.
 */
import * as React from 'react';

(globalThis as { React?: typeof React }).React = React;
