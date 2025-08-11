export interface GestureServiceInterface {
    startService(): Promise<void>;
    stopService(): Promise<void>;
    addListener(eventName: string): void;
    removeListeners(count: number): void;
}

export interface GestureEvent {
    event: 'scroll_up' | 'scroll_down' | 'swipe_left' | 'swipe_right' | 'tap' | 'return' | 'cursor' | 'copy';
    timestamp: number;
}

export type GestureEventType = GestureEvent['event'];