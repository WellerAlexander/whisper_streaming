import React, { useRef } from 'react';
import Button from "@mui/material/Button"
import UploadIcon from '@mui/icons-material/Upload';

const FileUploader = ({ onSelect }: { onSelect: (file: File) => void }) => {
    const inputRef = useRef<HTMLInputElement>(null);

    const handleClick = () => {
        inputRef.current?.click();
    }


    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) onSelect(file);
    };

    return (
        <>
            <input
                type="file"
                accept="audio/*"
                ref={inputRef}
                style={{ display: 'none' }}
                onChange={handleChange}
            />
            <Button
                variant="contained"
                startIcon={<UploadIcon />}
                onClick={handleClick}
            >
                Choose Audio File
            </Button>
        </>
    );
};


export default FileUploader;