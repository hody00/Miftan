'use client';
import {useEffect,useRef} from 'react';
export default function Modal({children,onClose}:{children:React.ReactNode;onClose:()=>void}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const dialog=ref.current!;dialog.showModal();return ()=>dialog.close();},[]);
 return <dialog ref={ref} className="modal panel" aria-labelledby="edit-title" onCancel={onClose}>{children}</dialog>;
}
