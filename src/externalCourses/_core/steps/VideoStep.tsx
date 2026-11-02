import type { CourseStep } from "../api/externalCoursesApi";

interface Props {
    step: CourseStep;
}

// Mismo visor que Soc1Course (VideoViewer).
// Un .mp4 directo (Cloudinary, etc.) se reproduce con <video> sin botón de descarga.
// Un link de plataforma (YouTube, Vimeo) se embebe en un iframe.

const isDirectVideo = (url: string) => /\.(mp4|webm|mov)(\?|#|$)/i.test(url) || /\/video\/upload\//i.test(url);

const VideoStep = ({ step }: Props) => {
    if (!step.url) {
        return (
            <div className="xs-pdf-error">
                <span>Video no disponible.</span>
            </div>
        );
    }

    if (isDirectVideo(step.url)) {
        return (
            <div className="xs-video-wrap xs-protected">
                <video
                    className="xs-video"
                    controls
                    controlsList="nodownload"
                    disablePictureInPicture
                    onContextMenu={(e) => e.preventDefault()}
                    preload="metadata"
                >
                    <source src={step.url} type="video/mp4" />
                    Tu navegador no soporta reproducción de video.
                </video>
            </div>
        );
    }

    return (
        <div className="xs-video-wrap xs-video-wrap--embed">
            <iframe
                src={step.url}
                title={step.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
            />
        </div>
    );
};

export default VideoStep;