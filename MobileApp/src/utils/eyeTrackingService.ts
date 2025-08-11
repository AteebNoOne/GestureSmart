import { NativeModules, NativeEventEmitter, EmitterSubscription } from 'react-native';
import { EyeEvent, EyeServiceInterface } from '../types/eyeTrackingTypes';


class EyeTrackingService {
    private eyeService: EyeServiceInterface;
    private eventEmitter: NativeEventEmitter;
    private subscription: EmitterSubscription | null = null;

    constructor() {
        this.eyeService = NativeModules.EyeService;

        if (!this.eyeService) {
            console.warn('EyeService native module not found. Make sure it is properly linked.');
            // Create a mock service for development
            this.eyeService = {
                startService: () => Promise.reject(new Error('EyeService not available')),
                stopService: () => Promise.reject(new Error('EyeService not available')),
                addListener: () => { },
                removeListeners: () => { },
            };
        }

        this.eventEmitter = new NativeEventEmitter(this.eyeService as any);
    }

    async startService(): Promise<void> {
        try {
            console.log('Starting eye tracking service...');
            await this.eyeService.startService();
            console.log('Eye tracking service started successfully');
        } catch (error) {
            console.error('Failed to start eye tracking service:', error);
            throw error;
        }
    }

    // Add this method to the EyeTrackingService class
    public ensureListenerActive(callback: (event: EyeEvent) => void) {
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
            console.log('Stopping eye tracking service...');
            await this.eyeService.stopService();
            console.log('Eye tracking service stopped successfully');
        } catch (error) {
            console.error('Failed to stop eye tracking service:', error);
            throw error;
        }
    }

    addListener(callback: (event: EyeEvent) => void): EmitterSubscription {
        if (this.subscription) {
            this.subscription.remove();
        }

        console.log('Adding eye event listener...');
        this.subscription = this.eventEmitter.addListener('onEyeEvent', (event: EyeEvent) => {
            console.log('Eye event received:', event);
            callback(event);
        });

        return this.subscription;
    }

    removeListener(): void {
        if (this.subscription) {
            console.log('Removing eye event listener...');
            this.subscription.remove();
            this.subscription = null;
        }
    }

    isAvailable(): boolean {
        return !!this.eyeService && this.eyeService.startService !== undefined;
    }
}

export const EyeService = new EyeTrackingService();
export type { EyeEvent };