export interface EyeServiceInterface {
    startService(): Promise<void>;
    stopService(): Promise<void>;
    addListener(eventName: string): void;
    removeListeners(count: number): void;

}

export interface EyeEvent {
    event: string;
    timestamp: number;
}
