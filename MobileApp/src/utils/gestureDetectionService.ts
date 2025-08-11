import { NativeModules, NativeEventEmitter, EmitterSubscription } from 'react-native';
import { GestureEvent, GestureServiceInterface } from '../types/gestureTypes';


class GestureDetectionService {
    private gestureService: GestureServiceInterface;
    private eventEmitter: NativeEventEmitter;
    private subscription: EmitterSubscription | null = null;

    constructor() {
        this.gestureService = NativeModules.GestureService;

        if (!this.gestureService) {
            console.warn('GestureService native module not found. Make sure it is properly linked.');
            // Create a mock service for development
            this.gestureService = {
                startService: () => Promise.reject(new Error('GestureService not available')),
                stopService: () => Promise.reject(new Error('GestureService not available')),
                addListener: () => { },
                removeListeners: () => { },
            };
        }

        this.eventEmitter = new NativeEventEmitter(this.gestureService as any);
    }

    async startService(): Promise<void> {
        try {
            console.log('Starting gesture tracking service...');
            await this.gestureService.startService();
            console.log('Gesture tracking service started successfully');
        } catch (error) {
            console.error('Failed to start gesture tracking service:', error);
            throw error;
        }
    }

    // Add this method to the GestureDetectionService class
    public ensureListenerActive(callback: (event: GestureEvent) => void) {
        if (!this.subscription) {
            this.addListener(callback);
        } else if (this.subscription) {
            // Refresh the listener
            this.subscription.remove();
            this.subscription = this.addListener(callback);
        }
    }

    async stopService(): Promise<void> {
        try {
            console.log('Stopping gesture tracking service...');
            await this.gestureService.stopService();
            console.log('Gesture tracking service stopped successfully');
        } catch (error) {
            console.error('Failed to stop gesture tracking service:', error);
            throw error;
        }
    }

    addListener(callback: (event: GestureEvent) => void): EmitterSubscription {
        if (this.subscription) {
            this.subscription.remove();
        }

        console.log('Adding gesture event listener...');
        this.subscription = this.eventEmitter.addListener('onGestureEvent', (event: GestureEvent) => {
            console.log('Gesture event received:', event);
            callback(event);
        });

        return this.subscription;
    }

    removeListener(): void {
        if (this.subscription) {
            console.log('Removing gesture event listener...');
            this.subscription.remove();
            this.subscription = null;
        }
    }

    isAvailable(): boolean {
        return !!this.gestureService && this.gestureService.startService !== undefined;
    }
}

export const GestureService = new GestureDetectionService();
export type { GestureEvent };