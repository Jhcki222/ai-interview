"use client";
import * as React from "react";
import * as Primitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
export const Dialog = Primitive.Root;
export const DialogTrigger = Primitive.Trigger;
export const DialogClose = Primitive.Close;
export function DialogContent({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Overlay className="dialog-overlay" />
      <Primitive.Content className={cn("dialog-content", className)} {...props}>
        {children}
        <Primitive.Close className="dialog-x" aria-label="닫기">
          <X size={18} />
        </Primitive.Close>
      </Primitive.Content>
    </Primitive.Portal>
  );
}
export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("dialog-header", className)} {...props} />;
}
export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("dialog-footer", className)} {...props} />;
}
export function DialogTitle({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof Primitive.Title>) {
  return <Primitive.Title className={cn("dialog-title", className)} {...props} />;
}
export function DialogDescription({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof Primitive.Description>) {
  return <Primitive.Description className={cn("dialog-description", className)} {...props} />;
}
