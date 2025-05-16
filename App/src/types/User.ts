export interface User {
    firstName: string;
    lastName: string;
    email: string;
    dateOfBirth: string | Date;
    age: string | number;
    phone: string;
    location: string;
    createdAt: string | Date;
    profileImage:string  | null;
}