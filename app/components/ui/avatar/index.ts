import { type HTMLAttributes } from 'vue'
import { type AvatarRootVariants, tv } from 'tailwind-variants'

export const avatarVariant = tv({
  base: 'relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full',
  variants: {
    size: {
      xs: 'h-6 w-6 text-[10px]',
      sm: 'h-8 w-8 text-xs',
      base: 'h-10 w-10',
      lg: 'h-12 w-12',
      xl: 'h-14 w-14',
    },
    shape: {
      circle: 'rounded-full',
      square: 'rounded-md',
    },
  },
  defaultVariants: {
    size: 'base',
    shape: 'circle',
  },
})

export type AvatarVariants = AvatarRootVariants

export { default as Avatar } from './Avatar.vue'
export { default as AvatarImage } from './AvatarImage.vue'
export { default as AvatarFallback } from './AvatarFallback.vue'
